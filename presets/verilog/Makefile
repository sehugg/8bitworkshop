
check:
	verilator --top-module frame_buffer_top --lint-only *.v
	iverilog -tnull *.v

deps.dot:
	grep \`include *.v | sed "s/:/ /g" | awk '{ print "\"" $1 "\" -> " $3 ";" }'

%.bin: %.v
	~/yosys/yosys -p "synth_ice40 -blif $*.blif" $*.v
	arachne-pnr -d 1k -p icestick.pcf $*.blif -o $*.asc
	icepack $*.asc $*.bin
	#iceprog $*.bin
	