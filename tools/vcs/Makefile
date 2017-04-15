
# convert PBM bitmap to playfield bytes
%-pf.hex: %-pf.pbm p4_to_pfbytes.py
	python p4_to_pfbytes.py $< > $@

# convert PBM bitmap to 48-pixel sprite
%-48.hex: %-48.pbm p4_to_48pix.py
	python p4_to_48pix.py $< > $@

# convert JPG to pbm

%-pf.pbm: %.jpg
	convert $< -resize 40x192\! -colorspace Gray -dither FloydSteinberg $@

%-48.pbm: %.jpg
	convert $< -resize 48x192\! -colorspace Gray -dither FloydSteinberg $@

