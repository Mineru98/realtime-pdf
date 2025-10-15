// PDF 뷰어 유틸리티 함수들

// PDF.js 라이브러리 설정 (화질 개선을 위한 CMap 및 worker 설정)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

class PDFViewer {
  constructor(canvasId, pageInfoId) {
    this.canvas = document.getElementById(canvasId);
    this.pageInfo = document.getElementById(pageInfoId);
    this.pdfDocument = null;
    this.currentPageNum = 1;
    this.scale = 1.5; // 화질 향상을 위해 기본 스케일을 1.5로 설정
    this.isFullscreen = false;
    this.minScale = 1.0; // 최소 스케일 제한으로 저화질 방지
  }

  async loadPDF(url) {
    try {
      // CMapPacked: true로 한글 폰트 지원 강화 (화질 저하 방지)
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapPacked: true,
        cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
      });
      this.pdfDocument = await loadingTask.promise;
      this.currentPageNum = 1;
      await this.renderPage(this.currentPageNum);
      return true;
    } catch (error) {
      console.error("PDF 로드 실패:", error);
      throw error;
    }
  }

  async renderPage(pageNum) {
    if (
      !this.pdfDocument ||
      pageNum < 1 ||
      pageNum > this.pdfDocument.numPages
    ) {
      return;
    }

    try {
      const page = await this.pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      const cssPixelRatio = window.devicePixelRatio || 1;
      this.canvas.height = viewport.height * cssPixelRatio;
      this.canvas.width = viewport.width * cssPixelRatio;
      this.canvas.style.width = viewport.width + "px";
      this.canvas.style.height = viewport.height + "px";

      const context = this.canvas.getContext("2d");
      context.scale(cssPixelRatio, cssPixelRatio);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        intent: "print",
      };

      await page.render(renderContext).promise;
      this.updatePageInfo(pageNum, this.pdfDocument.numPages);
    } catch (error) {
      console.error("페이지 렌더링 실패:", error);
      throw error;
    }
  }

  setFullscreenMode(isFullscreen) {
    this.isFullscreen = isFullscreen;
    if (isFullscreen) {
      this.adjustScaleForFullscreen().then(() => {
        if (this.pdfDocument) {
          this.renderPage(this.currentPageNum);
        }
      });
    } else {
      this.scale = 1.5; // 화질 향상을 위해 기본 스케일로 복원
      if (this.pdfDocument) {
        this.renderPage(this.currentPageNum);
      }
    }
  }

  async adjustScaleForFullscreen() {
    if (!this.pdfDocument || this.currentPageNum < 1) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // 페이지 컨트롤 높이 여백만 고려
    const availableHeight = screenHeight - 80;
    const availableWidth = screenWidth;

    const page = await this.pdfDocument.getPage(this.currentPageNum);

    // 원본 페이지 viewport (scale=1)로 가로 우선 fit scale 계산
    const originalViewport = page.getViewport({ scale: 1.0 });
    const fitScaleX = availableWidth / originalViewport.width;

    // 가로에 맞게 확대, 최소 1.0 (세로는 스크롤로 처리)
    this.scale = Math.max(fitScaleX, 1.0);
  }

  updatePageInfo(current, total) {
    if (this.pageInfo) {
      this.pageInfo.textContent = `페이지 ${current} / ${total}`;
    }
  }

  nextPage() {
    if (this.pdfDocument && this.currentPageNum < this.pdfDocument.numPages) {
      this.currentPageNum++;
      this.renderPage(this.currentPageNum);
      return this.currentPageNum;
    }
    return null;
  }

  prevPage() {
    if (this.pdfDocument && this.currentPageNum > 1) {
      this.currentPageNum--;
      this.renderPage(this.currentPageNum);
      return this.currentPageNum;
    }
    return null;
  }

  goToPage(pageNum) {
    if (
      this.pdfDocument &&
      pageNum >= 1 &&
      pageNum <= this.pdfDocument.numPages
    ) {
      this.currentPageNum = pageNum;
      if (this.isFullscreen) {
        this.adjustScaleForFullscreen();
      } else {
        this.renderPage(pageNum);
      }
      return pageNum;
    }
    return null;
  }

  setScale(scale) {
    // 최소 스케일 제한으로 화질 저하 방지
    this.scale = Math.max(scale, this.minScale);
    if (this.pdfDocument) {
      this.renderPage(this.currentPageNum);
    }
  }

  getCurrentPage() {
    return this.currentPageNum;
  }

  getTotalPages() {
    return this.pdfDocument ? this.pdfDocument.numPages : 0;
  }
}

// 전역 PDF 뷰어 인스턴스 (HTML에서 사용)
window.pdfViewer = new PDFViewer("pdfCanvas", "pageInfo");
