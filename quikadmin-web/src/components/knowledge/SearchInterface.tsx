/**
 * SearchInterface component for Knowledge Base search
 * Features: Semantic search, hybrid search, search results display
 * @module components/knowledge/SearchInterface
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  Settings2,
  Clock,
  Sparkles,
  Zap,
  Book,
  ExternalLink,
} from 'lucide-react';
import {
  useKnowledgeStore,
  useSearchResults,
  useSearchLoading,
  useSearchQuery,
} from '@/stores/knowledgeStore';
import { SearchResult } from '@/services/knowledgeService';
import { useDebouncedValue } from '@/hooks/useDebounce';

// ============================================================================
// Types
// ============================================================================

interface SearchOptions {
  topK: number;
  minScore: number;
  hybridMode: 'balanced' | 'semantic' | 'keyword';
  useHybrid: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function SearchResultCard({ result, index }: { result: SearchResult; index: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const similarity = Math.round(result.similarity * 100);

  // Determine score badge color
  const scoreColor =
    similarity >= 80
      ? 'bg-status-success/10 text-status-success-foreground'
      : similarity >= 60
        ? 'bg-status-warning/10 text-status-warning-foreground'
        : 'bg-status-warning/10 text-status-warning-foreground';

  // Truncate text for preview
  const previewText =
    result.text.length > 300 ? result.text.substring(0, 300) + '...' : result.text;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-sm font-medium">
              {index + 1}
            </div>
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {result.sourceTitle}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {result.pageNumber && `Page ${result.pageNumber}`}
                {result.pageNumber && result.sectionHeader && ' | '}
                {result.sectionHeader && result.sectionHeader}
                {!result.pageNumber && !result.sectionHeader && `Chunk ${result.chunkIndex + 1}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={scoreColor} variant="secondary">
              {similarity}% match
            </Badge>
            {result.vectorScore !== undefined && result.keywordScore !== undefined && (
              <Badge variant="outline" className="text-xs">
                V:{Math.round(result.vectorScore * 100)}% K:{Math.round(result.keywordScore * 100)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-3 px-4 border-t">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {expanded ? result.text : previewText}
          </div>
          {result.text.length > 300 && (
            <CollapsibleTrigger asChild>
              <Button variant="link" size="sm" className="h-auto p-0 mt-2">
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          )}
          <CollapsibleContent />
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function SearchOptionsPanel({
  options,
  onChange,
}: {
  options: SearchOptions;
  onChange: (options: SearchOptions) => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center justify-between">
        <Label htmlFor="hybrid-switch" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Hybrid Search
        </Label>
        <Switch
          id="hybrid-switch"
          checked={options.useHybrid}
          onCheckedChange={(checked) => onChange({ ...options, useHybrid: checked })}
        />
      </div>

      {options.useHybrid && (
        <div className="space-y-2">
          <Label>Search Mode</Label>
          <Select
            value={options.hybridMode}
            onValueChange={(value: 'balanced' | 'semantic' | 'keyword') =>
              onChange({ ...options, hybridMode: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Balanced (70% semantic, 30% keyword)
                </div>
              </SelectItem>
              <SelectItem value="semantic">
                <div className="flex items-center gap-2">
                  <Book className="h-4 w-4" />
                  Semantic (90% semantic, 10% keyword)
                </div>
              </SelectItem>
              <SelectItem value="keyword">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Keyword (30% semantic, 70% keyword)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Results to Return</Label>
          <span className="text-sm text-muted-foreground">{options.topK}</span>
        </div>
        <Slider
          value={[options.topK]}
          onValueChange={([value]) => onChange({ ...options, topK: value })}
          min={1}
          max={20}
          step={1}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Minimum Score</Label>
          <span className="text-sm text-muted-foreground">
            {Math.round(options.minScore * 100)}%
          </span>
        </div>
        <Slider
          value={[options.minScore * 100]}
          onValueChange={([value]) => onChange({ ...options, minScore: value / 100 })}
          min={0}
          max={100}
          step={5}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SearchInterface() {
  // Store state
  const searchResults = useSearchResults();
  const searchLoading = useSearchLoading();
  const searchQuery = useSearchQuery();

  // Store actions
  const { search, hybridSearch, clearSearch, setSearchQuery } = useKnowledgeStore();

  // Local state
  const [query, setQuery] = React.useState(searchQuery);
  const [showOptions, setShowOptions] = React.useState(false);
  const [options, setOptions] = React.useState<SearchOptions>({
    topK: 5,
    minScore: 0.5,
    hybridMode: 'balanced',
    useHybrid: false,
  });
  const [searchTime, setSearchTime] = React.useState(0);

  // Debounce query for autocomplete (future feature)
  const debouncedQuery = useDebouncedValue(query, 300);

  // Handle search
  const handleSearch = async () => {
    if (!query.trim()) return;

    const startTime = Date.now();

    if (options.useHybrid) {
      await hybridSearch({
        query: query.trim(),
        topK: options.topK,
        minScore: options.minScore,
        hybridMode: options.hybridMode,
      });
    } else {
      await search({
        query: query.trim(),
        topK: options.topK,
        minScore: options.minScore,
      });
    }

    setSearchTime(Date.now() - startTime);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle clear
  const handleClear = () => {
    setQuery('');
    clearSearch();
    setSearchTime(0);
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your knowledge base..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-9 pr-4"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowOptions(!showOptions)}
          className={showOptions ? 'bg-muted' : ''}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button onClick={handleSearch} disabled={!query.trim() || searchLoading}>
          {searchLoading ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Search Options */}
      {showOptions && <SearchOptionsPanel options={options} onChange={setOptions} />}

      {/* Results Summary */}
      {searchResults.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              Found <strong className="text-foreground">{searchResults.length}</strong> results
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {searchTime}ms
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear results
          </Button>
        </div>
      )}

      {/* Search Results */}
      {searchLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4 border-t">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-3">
          {searchResults.map((result, index) => (
            <SearchResultCard key={result.id} result={result} index={index} />
          ))}
        </div>
      ) : searchQuery && !searchLoading ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm mt-1">
              Try adjusting your search terms or lowering the minimum score threshold
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Search your knowledge base</p>
            <p className="text-sm mt-1">
              Enter a query to find relevant information from your uploaded documents
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default SearchInterface;
