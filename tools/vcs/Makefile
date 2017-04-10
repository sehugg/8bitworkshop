
%-pf.hex: %-pf.pbm p4_to_pfbytes.py
	python p4_to_pfbytes.py $< > $@

%-48.hex: %-48.pbm p4_to_48pix.py
	python p4_to_48pix.py $< > $@

%-pf.pbm: %.jpg
	convert $< -resize 40x192\! -colorspace Gray -dither FloydSteinberg $@

%-48.pbm: %.jpg
	convert $< -resize 48x192\! -colorspace Gray -dither FloydSteinberg $@

