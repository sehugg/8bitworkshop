
check:
	verilator --top-module frame_buffer_top --lint-only *.v
	iverilog -tnull *.v

deps.dot:
	grep \`include *.v | sed "s/:/ /g" | awk '{ print "\"" $1 "\" -> " $3 ";" }'
