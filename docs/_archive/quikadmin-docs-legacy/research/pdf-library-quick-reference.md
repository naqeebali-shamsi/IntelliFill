# PDF Library Quick Reference for PDF-Filler Tool

## TL;DR Recommendations 🚀

| Use Case                    | Primary Library  | Secondary Library | Why                                           |
| --------------------------- | ---------------- | ----------------- | --------------------------------------------- |
| **Web App (Client)**        | pdf-lib          | pdfjs-dist        | Zero deps, universal browser support          |
| **Enterprise Server**       | Apache PDFBox    | PDFtk fallback    | High performance, comprehensive features      |
| **Python Environment**      | pypdf            | PyMuPDF\*         | Pure Python, performance boost for extraction |
| **Command-Line/Automation** | PDFtk            | -                 | Proven reliability, batch processing          |
| **Cross-Platform**          | pdf-lib + PDFBox | -                 | Best of both worlds                           |

\*Not in original analysis but recommended based on pypdf performance limitations

## Installation Commands

```bash
# JavaScript (npm)
npm install pdf-lib pdfjs-dist

# Python (pip)
pip install pypdf PyMuPDF

# Java (Maven)
<dependency>
  <groupId>org.apache.pdfbox</groupId>
  <artifactId>pdfbox</artifactId>
  <version>3.0.4</version>
</dependency>

# Command-line (Ubuntu/Debian)
sudo apt-get install pdftk-java
```

## 30-Second Code Examples

### Fill Form Fields (pdf-lib)

```javascript
import { PDFDocument } from 'pdf-lib';

const pdfDoc = await PDFDocument.load(pdfBytes);
const form = pdfDoc.getForm();
form.getTextField('name').setText('John Doe');
const filledBytes = await pdfDoc.save();
```

### Preview PDF (pdfjs-dist)

```javascript
import * as pdfjsLib from 'pdfjs-dist';

const pdf = await pdfjsLib.getDocument(pdfBytes).promise;
const page = await pdf.getPage(1);
await page.render({ canvasContext, viewport }).promise;
```

### Enterprise Processing (PDFBox)

```java
PDDocument doc = PDDocument.load(pdfBytes);
PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
form.getField("name").setValue("John Doe");
doc.save(outputStream);
```

### Batch Fill (PDFtk)

```bash
pdftk template.pdf fill_form data.fdf output filled.pdf
```

## Performance Cheat Sheet

| Operation           | Fastest → Slowest                             |
| ------------------- | --------------------------------------------- |
| **Form Filling**    | PDFBox > PDFtk > pdf-lib > pypdf              |
| **Text Extraction** | PyMuPDF > PDFBox > pdfjs-dist > pypdf         |
| **Memory Usage**    | PDFBox > PDFtk > pdf-lib > pdfjs-dist > pypdf |
| **Startup Time**    | pdf-lib > pypdf > pdfjs-dist > PDFtk > PDFBox |

## Decision Tree 🌳

```
Need PDF form filling?
├── Web browser environment?
│   ├── Yes → pdf-lib (+ pdfjs-dist for preview)
│   └── No → Continue below
├── High performance/enterprise?
│   ├── Yes → Apache PDFBox
│   └── No → Continue below
├── Python environment?
│   ├── Yes → pypdf (+ PyMuPDF for speed)
│   └── No → Continue below
├── Command-line/automation?
│   ├── Yes → PDFtk
│   └── No → pdf-lib (most universal)
```

## Feature Matrix (Quick View)

| Feature      | pdf-lib | pypdf | pdfjs-dist | PDFtk | PDFBox |
| ------------ | :-----: | :---: | :--------: | :---: | :----: |
| Form Fill    |   ✅    |  ✅   |     ⚠️     |  ✅   |   ✅   |
| Text Extract |   ⚠️    |  ✅   |     ✅     |  ✅   |   ✅   |
| Rendering    |   ❌    |  ❌   |     ✅     |  ❌   |   ⚠️   |
| Zero Deps    |   ✅    |  ✅   |     ❌     |  ❌   |   ❌   |
| Browser      |   ✅    |  ❌   |     ✅     |  ❌   |   ❌   |
| Enterprise   |   ⚠️    |  ⚠️   |     ✅     |  ✅   |   ✅   |

Legend: ✅ Excellent, ⚠️ Limited/Partial, ❌ Not Supported

## License Compatibility

| Library    | License    | Commercial OK? | Attribution Required? |
| ---------- | ---------- | :------------: | :-------------------: |
| pdf-lib    | MIT        |       ✅       |          ❌           |
| pypdf      | BSD        |       ✅       |          ❌           |
| pdfjs-dist | Apache 2.0 |       ✅       |          ✅           |
| PDFtk      | GPL        |       ⚠️       |          ✅           |
| PDFBox     | Apache 2.0 |       ✅       |          ✅           |

## Common Pitfalls & Solutions

### pdf-lib

- **Issue**: Can't extract non-form text
- **Solution**: Use pdfjs-dist for text extraction

### pypdf

- **Issue**: Slow text extraction (10-20x slower)
- **Solution**: Use PyMuPDF for performance-critical text operations

### pdfjs-dist

- **Issue**: Large bundle size
- **Solution**: Dynamic imports, lazy loading

### PDFtk

- **Issue**: GPL license restrictions
- **Solution**: Use via subprocess/API to avoid linking

### PDFBox

- **Issue**: JVM requirement
- **Solution**: Accept the dependency or use alternatives

## File Size Recommendations

| File Size | Recommended Approach              |
| --------- | --------------------------------- |
| < 1MB     | Client-side (pdf-lib)             |
| 1-10MB    | Hybrid (client + server fallback) |
| 10-100MB  | Server-side (PDFBox)              |
| > 100MB   | Batch processing (PDFtk)          |

## Final Architecture Recommendation

### Optimal Setup for PDF-Filler Tool:

1. **Frontend**: pdf-lib + pdfjs-dist (JavaScript)
2. **Backend**: Apache PDFBox (Java)
3. **Fallback**: PDFtk (Command-line)

This combination provides:

- ✅ Complete form field support
- ✅ Excellent performance
- ✅ Scalable architecture
- ✅ License compatibility
- ✅ Enterprise readiness

**Implementation Priority**: Start with pdf-lib, add PDFBox for scale, integrate PDFtk for edge cases.

---

_Research completed: 5 libraries analyzed, 8 criteria evaluated, hybrid architecture recommended_
