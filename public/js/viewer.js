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
      this.adjustScaleForFullscreen();
    } else {
      this.scale = 1.5; // 화질 향상을 위해 기본 스케일로 복원
    }
    if (this.pdfDocument) {
      this.renderPage(this.currentPageNum);
    }
  }

  adjustScaleForFullscreen() {
    if (!this.pdfDocument || this.currentPageNum < 1) return;

    // 기본 화질 향상 스케일(1.5)을 유지하되, 화면이 너무 작으면 화면에 맞게 축소
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // 페이지 컨트롤과 버튼을 위한 여백을 고려
    const availableHeight = screenHeight - 80; // 페이지 컨트롤 높이와 여백
    const availableWidth = screenWidth - 40; // 좌우 여백

    this.pdfDocument.getPage(this.currentPageNum).then((page) => {
      const baseViewport = page.getViewport({ scale: 1.5 }); // 기본 화질 향상 스케일

      // 기본 스케일이 화면에 맞지 않으면 축소, 그렇지 않으면 1.5배 유지
      const scaleX = availableWidth / baseViewport.width;
      const scaleY = availableHeight / baseViewport.height;

      if (
        baseViewport.width <= availableWidth &&
        baseViewport.height <= availableHeight
      ) {
        this.scale = 1.5; // 기본 화질 향상 스케일 유지
      } else {
        this.scale = Math.min(scaleX, scaleY) * 1.5; // 화면에 맞게 축소하되 화질 유지
      }

      this.renderPage(this.currentPageNum);
    });
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
