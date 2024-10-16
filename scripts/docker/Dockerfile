# Use the Debian 11 slim image
FROM --platform=linux/amd64 debian:11-slim

# Set the working directory
WORKDIR /app

# Set the _8BITWS_SERVER_ROOT environment variable
ENV _8BITWS_SERVER_ROOT /app

# Change to app dir
RUN cd /app

#RUN apt-get install -y ca-certificates curl gnupg
#RUN mkdir -p /etc/apt/keyrings
#RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
#ENV NODE_MAJOR 20
#RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

# Install necessary packages
RUN apt-get update
RUN apt-get install -y curl xz-utils

# Install a more recent version of Node.js (adjust the version as needed)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Fetch the LLVM-Mos tarball and extract it
RUN curl -L https://github.com/llvm-mos/llvm-mos-sdk/releases/latest/download/llvm-mos-linux.tar.xz | xz -d | tar x -C /app

# Fetch Oscar64
RUN curl -L https://github.com/drmortalwombat/oscar64/archive/refs/tags/v1.31.255.tar.gz | tar xz -C /app
RUN cd /app/oscar64 && make -f make/makefile compiler

# Fetch the SDCC tarball
#RUN apt-get install -y bzip2
#RUN curl -L https://cytranet.dl.sourceforge.net/project/sdcc/sdcc-linux-amd64/4.3.0/sdcc-4.3.0-amd64-unknown-linux2.5.tar.bz2 | tar xj -C /app

# Clean up after APT
RUN apt-get autoremove -y \
    && apt-get clean -y \
    && apt-get autoclean -y
RUN rm -rf /var/lib/apt/lists/*

# Expose the port your server will listen on
EXPOSE 3009

# Fetch the Node.js Express server.js file at runtime
RUN curl -O https://sehugg.github.io/8bitworkshop/gen/server/server.js

# Copy the run script
COPY run.sh /app/run.sh

# Start the Node.js Express server
CMD ["sh", "-a", "run.sh"]
