# Makefile for LaTeX presentation compilation

TEXFILE = presentation.tex
PDFFILE = presentation.pdf

# Default target
all: $(PDFFILE)

# Compile PDF using pdflatex
$(PDFFILE): $(TEXFILE)
	pdflatex $(TEXFILE)
	pdflatex $(TEXFILE)  # Run twice for proper references

# Clean auxiliary files
clean:
	rm -f *.aux *.log *.nav *.out *.snm *.toc *.vrb

# Clean everything including PDF
cleanall: clean
	rm -f $(PDFFILE)

# Phony targets
.PHONY: all clean cleanall

