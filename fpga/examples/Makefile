
%.asc: %.v icestick.pcf
	yosys -p "synth_ice40 -blif $*.blif" $*.v | tee $*.log
	arachne-pnr -d 1k -p icestick.pcf $*.blif -o $*.asc

%.bin: %.asc
	icetime -c 12 -d hx1k $*.asc
	icepack $*.asc $*.bin

%.prog: %.bin
	iceprog $<

%.hex: %.asm
	node ../../src/tools/jsasm.js < $< > $@

%.vlog: %.asc
	icebox_vlog $*.asc > $*.vlog

%.vcd: %.vlog test.vlog
	iverilog -o $*.out -v /usr/share/yosys/ice40/cells_sim.v $< test.vlog
	vvp $*.out

