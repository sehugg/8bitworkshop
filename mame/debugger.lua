-- JS debug support for MAME using -debugger none

mamedbg = {}

local debugging = false
local stopped = false

function mamedbg.init()
  cpu = manager:machine().devices[":maincpu"]
  mem = cpu.spaces["program"]
  debugger = manager:machine():debugger()
  mamedbg.reset()
  emu.register_periodic(function ()
    if debugging then
      if not stopped then
        --debugger:command("symlist")
        --log = debugger.consolelog
        --for i=1,#log do print(log[i]) end
        --print(string.format("%4x", cpu.state["PC"].value))
        --manager:machine():save("state")
        emu.pause()
        stopped = true
        -- callback to JS via console i/o
        mamedbg.printstate()
        print(">>>debug_stopped")
        print("1")
      end
    end
  end)
end

function mamedbg.printstate()
  for k,v in pairs(cpu.state) do print(">>>cpu_"..k); print(v.value) end
end

function mamedbg.reset()
  debugging = false
  stopped = false
end

function mamedbg.start()
  debugging = true
  stopped = false
end

function mamedbg.is_stopped()
  return debugging and stopped
end

function mamedbg.runTo(addr)
  debugger:command("g " .. string.format("%x", addr))
  mamedbg.start()
end

function mamedbg.runToVsync(addr)
  debugger:command("gv")
  mamedbg.start()
end

function mamedbg.runUntilReturn(addr)
  debugger:command("out")
  mamedbg.start()
end

function mamedbg.step()
  debugger:command("step")
  mamedbg.start()
end

print("parsed Lua debugger script")
