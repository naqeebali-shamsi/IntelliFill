# OCR Low Confidence Monitoring & Alerts

**Status**: Documentation Only (Requires Log Aggregation Setup)

**Purpose**: Alert when >5% of documents in 24h fall below confidence threshold (REQ-005)

## Current Implementation

### Logging Infrastructure

The OCR queue (`quikadmin/src/queues/ocrQueue.ts`) already logs low-confidence documents:

```typescript
// Line 325-332
if (ocrResult.confidence < OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
  logger.warn('LOW_CONFIDENCE_OCR', {
    documentId,
    confidence: ocrResult.confidence,
    threshold: OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD,
    fileType: isImage ? 'image' : 'scanned_pdf',
    storageUrl: filePath.length > 50 ? filePath.slice(0, 50) + '...' : filePath,
    wasConvertedFromPdf: !isImage,
  });
}
```

**Configuration**:

- Default threshold: 40% (configurable via `OCR_LOW_CONFIDENCE_THRESHOLD` env var)
- Logger: Winston with JSON format
- Output: `logs/combined.log` and `logs/error.log`

## Monitoring Setup Options

### Option 1: Grafana Loki (Recommended for File-based Logs)

**Setup**:

1. Install Grafana Loki to aggregate Winston logs
2. Configure promtail to ship logs from `logs/combined.log` to Loki
3. Create Grafana dashboard with LogQL query

**LogQL Query**:

```logql
sum(
  rate({job="intellifill"} |= "LOW_CONFIDENCE_OCR" | json [24h])
)
/
sum(
  rate({job="intellifill"} |= "OCR job completed" | json [24h])
) > 0.05
```

**Alert Rule**:

```yaml
# grafana-alerts.yml
groups:
  - name: ocr_quality
    rules:
      - alert: HighLowConfidenceOCRRate
        expr: |
          sum(rate({job="intellifill"} |= "LOW_CONFIDENCE_OCR" [24h]))
          / sum(rate({job="intellifill"} |= "OCR job completed" [24h])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High rate of low-confidence OCR results'
          description: '{{ $value | humanizePercentage }} of OCR jobs in last 24h fell below confidence threshold'
```

### Option 2: PostgreSQL + Grafana (Requires Log Shipping)

**Prerequisites**:

1. Create logs table in PostgreSQL
2. Ship Winston logs to PostgreSQL (using `winston-postgresql` or similar)

**Schema**:

```sql
CREATE TABLE ocr_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  INDEX idx_timestamp (timestamp),
  INDEX idx_level_message (level, message)
);
```

**Grafana SQL Query**:

```sql
WITH ocr_stats AS (
  SELECT
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) FILTER (WHERE message = 'LOW_CONFIDENCE_OCR') as low_confidence_count,
    COUNT(*) FILTER (WHERE message LIKE '%OCR job completed%') as total_ocr_jobs
  FROM ocr_logs
  WHERE
    timestamp >= NOW() - INTERVAL '24 hours'
    AND level = 'warn'
    AND $__timeFilter(timestamp)
  GROUP BY hour
)
SELECT
  hour as time,
  low_confidence_count::float / NULLIF(total_ocr_jobs, 0) as confidence_ratio,
  low_confidence_count,
  total_ocr_jobs
FROM ocr_stats
ORDER BY hour DESC;
```

**Alert Condition**:

```sql
SELECT
  COUNT(*) FILTER (WHERE message = 'LOW_CONFIDENCE_OCR')::float
  / NULLIF(COUNT(*) FILTER (WHERE message LIKE '%OCR job completed%'), 0) as ratio
FROM ocr_logs
WHERE
  timestamp >= NOW() - INTERVAL '24 hours'
  AND level IN ('warn', 'info')
HAVING ratio > 0.05;
```

### Option 3: Elasticsearch + Kibana

**Setup**:

1. Use `winston-elasticsearch` transport
2. Configure Kibana Watcher for alerts

**Watcher Configuration**:

```json
{
  "trigger": {
    "schedule": {
      "interval": "1h"
    }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["intellifill-logs-*"],
        "body": {
          "query": {
            "bool": {
              "filter": [
                { "range": { "@timestamp": { "gte": "now-24h" } } },
                { "term": { "level": "warn" } }
              ]
            }
          },
          "aggs": {
            "low_confidence_ratio": {
              "filters": {
                "filters": {
                  "low_confidence": { "term": { "message": "LOW_CONFIDENCE_OCR" } },
                  "total_ocr": { "wildcard": { "message": "*OCR job completed*" } }
                }
              }
            }
          }
        }
      }
    }
  },
  "condition": {
    "script": {
      "source": "return (ctx.payload.aggregations.low_confidence_ratio.buckets.low_confidence.doc_count / ctx.payload.aggregations.low_confidence_ratio.buckets.total_ocr.doc_count) > 0.05"
    }
  },
  "actions": {
    "notify_slack": {
      "webhook": {
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "body": "{\"text\": \"Alert: {{ ctx.payload.aggregations.low_confidence_ratio.buckets.low_confidence.doc_count }} / {{ ctx.payload.aggregations.low_confidence_ratio.buckets.total_ocr.doc_count }} OCR jobs ({{ ctx.payload._value }}%) below confidence threshold in last 24h\"}"
      }
    }
  }
}
```

## Integration with Notification Services

### Slack Integration

**Grafana Notification Channel**:

```yaml
notifiers:
  - name: ocr-alerts
    type: slack
    uid: ocr-slack
    org_id: 1
    settings:
      url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
      recipient: '#ocr-monitoring'
      username: IntelliFill Monitoring
```

### PagerDuty Integration

**Grafana Notification Channel**:

```yaml
notifiers:
  - name: ocr-pagerduty
    type: pagerduty
    uid: ocr-pd
    settings:
      integrationKey: YOUR_INTEGRATION_KEY
      severity: warning
      class: ocr-quality
```

## Testing

### Load Test Scenario

```bash
# Generate 100 OCR jobs with 6 low-confidence results (6%)
# Expected: Alert should fire

# 1. Create test documents with known low confidence characteristics
# (e.g., rotated images, low DPI scans)

# 2. Upload batch of 100 documents:
#    - 94 good quality documents
#    - 6 low quality documents (rotated, low DPI)

# 3. Verify alert fires within 5 minutes

# 4. Test below threshold (4%)
# Upload 100 documents with only 4 low quality
# Expected: No alert
```

### Manual Verification

```bash
# Check logs for LOW_CONFIDENCE_OCR events
grep -c "LOW_CONFIDENCE_OCR" logs/combined.log

# Check total OCR jobs
grep -c "OCR job completed" logs/combined.log

# Calculate ratio
# Should match alert threshold (>5% triggers alert)
```

## Dashboard Metrics

Recommended Grafana dashboard panels:

1. **Low Confidence Rate (24h)** - Line graph showing ratio over time
2. **Low Confidence Count** - Count of LOW_CONFIDENCE_OCR events
3. **Total OCR Jobs** - Total jobs processed
4. **Breakdown by File Type** - Table showing confidence by image vs scanned_pdf
5. **Confidence Distribution** - Histogram of confidence values

## Next Steps

To activate this monitoring:

1. Choose log aggregation option (Loki recommended for simplicity)
2. Set up log shipping from Winston to aggregator
3. Create Grafana dashboard with queries above
4. Configure alert rules with 5% threshold
5. Integrate with Slack/PagerDuty
6. Run load test to verify alerts fire correctly

## References

- Task 342: OCR Confidence Calculation (completed)
- Task 343: Low Confidence Logging (completed)
- Task 344: This monitoring implementation
- `quikadmin/src/queues/ocrQueue.ts` - Source of truth for logging format
