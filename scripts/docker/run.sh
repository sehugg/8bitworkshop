#!/bin/sh

export _8BITWS_SERVER_ROOT=/app

cd "$_8BITWS_SERVER_ROOT"

curl -O https://sehugg.github.io/8bitworkshop/gen/server/server.js

while true; do

  node server.js

  # Check if the server crashed (exited with a non-zero status)
  if [ $? -ne 0 ]; then
    echo "Server crashed. Restarting in 10 seconds..."
    sleep 10
  else
    # If the server exited normally (e.g., due to manual termination), exit the loop
    break
  fi
done
