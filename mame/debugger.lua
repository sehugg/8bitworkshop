-- JS debug support for MAME using -debugger none

mamedbg = {}

local debugging = false
local stopped = false

function mamedbg.init()
  cpu = manager:machine().devices[":maincpu"]
  mem = cpu.spaces["program"]
  machine = manager:machine()
  debugger = machine:debugger()
  mamedbg.reset()
  emu.register_periodic(function ()
    if debugging and not stopped then
      --print(debugger.execution_state)
      lastBreakState = machine.buffer_save()
      emu.pause()
      stopped = true
    end
  end)
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

function mamedbg.continue()
  debugger:command("g")
end

function mamedbg.runTo(addr)
  debugger:command(string.format("g %x", addr))
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

function string.fromhex(str)
    return (str:gsub('..', function (cc)
        return string.char(tonumber(cc, 16))
    end))
end

function string.tohex(str)
    return (str:gsub('.', function (c)
        return string.format('%02X', string.byte(c))
    end))
end

print("parsed Lua debugger script")
