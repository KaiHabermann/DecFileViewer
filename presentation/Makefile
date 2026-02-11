# Makefile for LaTeX presentation compilation

TEXFILE = presentation.tex
PDFFILE = presentation.pdf

TIKZ_DIR = tikz
TIKZ_TEX = $(wildcard $(TIKZ_DIR)/*.tex)
TIKZ_PDFS = $(TIKZ_TEX:.tex=.pdf)

# Default target: build TikZ figures first, then main presentation
all: $(TIKZ_PDFS) $(PDFFILE)

# Compile main presentation PDF using pdflatex
$(PDFFILE): $(TEXFILE)
	pdflatex $(TEXFILE)
	pdflatex $(TEXFILE)  # Run twice for proper references

# Compile standalone TikZ figures
$(TIKZ_DIR)/%.pdf: $(TIKZ_DIR)/%.tex
	pdflatex -output-directory $(TIKZ_DIR) $<

# Clean auxiliary files (both main and TikZ)
clean:
	rm -f *.aux *.log *.nav *.out *.snm *.toc *.vrb
	rm -f $(TIKZ_DIR)/*.aux $(TIKZ_DIR)/*.log $(TIKZ_DIR)/*.nav $(TIKZ_DIR)/*.out $(TIKZ_DIR)/*.snm $(TIKZ_DIR)/*.toc $(TIKZ_DIR)/*.vrb

# Clean everything including PDFs
cleanall: clean
	rm -f $(PDFFILE)
	rm -f $(TIKZ_DIR)/*.pdf

# Phony targets
.PHONY: all clean cleanall

