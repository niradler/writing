---
title: Fast Debugging and Process Management for Containers
description: 'HotPod is an open-source, lightweight process manager built in Go, designed to dynamically start, stop, and restart processes inside running containers. It'
publishedAt: '2025-02-07T19:36:06.217Z'
updatedAt: '2025-02-07T19:38:16.086Z'
tags:
  - docker
  - k8s
  - containers
sourceUrl: 'https://blog.niradler.com/introducing-hotpod-process-manager'
originalUrl: 'https://blog.niradler.com/introducing-hotpod-process-manager'
sourceMarkdown: 'https://blog.niradler.com/introducing-hotpod-process-manager.md'
series: Open source
seriesSlug: open-source
cover: /media/introducing-hotpod-process-manager/cover.png
coverAlt: 'Introducing HotPod: Fast Debugging and Process Management for Containers'
---
# Introducing HotPod: Fast Debugging and Process Management for Containers

<figure class="media" data-align="center">
<img src="/media/introducing-hotpod-process-manager/99dc03de-7a21-4a41-ad8f-02f4f03268a3.png" alt="" loading="lazy" decoding="async" data-align="center">
</figure>

# Overview

When debugging code inside a container, developers often need to build a new image and deploy a new pod, which can be slow and cumbersome. HotPod eliminates this hassle by allowing developers to copy updated files into a running container and restart the process with the new code—without redeploying the container. This makes debugging and development faster and more efficient.

HotPod is an open-source, lightweight process manager built in Go, designed to dynamically start, stop, and restart processes inside running containers. It provides an easy way to manage processes while keeping the pod alive.

## Why HotPod?

HotPod is designed to solve common challenges faced when debugging and managing processes inside containers:

* **Fast Debugging and Development**: Modify code in a running container and restart the process instantly without redeploying.
    
* **Keep-Alive Functionality**: Ensures the container stays up by restarting critical processes automatically if they exit unexpectedly.
    
* **Lightweight and Efficient**: Written in Go with minimal resource overhead, making it ideal for cloud-native applications.
    
* **Graceful Shutdown**: Supports SIGTERM handling with fallback to SIGKILL for robust process control.
    
* **Thread-Safe Execution**: Utilizes Go's synchronization mechanisms to prevent multiple instances of the same process from running simultaneously.
    

## Getting Started with HotPod

### Installation

Download the latest HotPod release from the [GitHub releases page](https://github.com/niradler/hotpod/releases):

```sh
wget https://github.com/niradler/hotpod/releases/latest/download/hotpod-linux-amd64 -O hotpod
chmod +x hotpod
./hotpod -help
```

### Running a Process with HotPod

You can use HotPod to run and manage a simple HTTP server inside a container:

```sh
./hotpod -command "python -m http.server 8000" -shell "sh" -keepalive=true -host localhost -port 8080
```

### Deploying HotPod in a Container

To demonstrate HotPod in action, let’s set up a Python-based container that uses HotPod to manage its processes.

#### Example: Running a Python Server with HotPod

Create a `Dockerfile`:

```dockerfile
FROM python:3.9-alpine
WORKDIR /app

ARG HOTPOD_VERSION=latest

RUN wget https://github.com/niradler/hotpod/releases/latest/download/hotpod-linux-amd64 -O /app/hotpod && \
    chmod +x /app/hotpod

CMD ["./hotpod", "-command", "python ./app.py", "-port", "8080", "-keepalive", "-host", ""]
```

#### Running the Container

```sh
docker build -t my-python-app .
docker run -d --name my-app-container my-python-app
```

### Hot-Reloading Code Without Restarting the Container

Instead of rebuilding and redeploying an image to apply code changes, use HotPod to dynamically update your running process.

1. Copy the updated script into the running container:
    
    ```sh
    docker cp new_app.py my-app-container:/app/new_app.py
    ```
    
2. Use HotPod’s API to restart the process with the new code:
    
    ```sh
    curl -X POST http://localhost:8080/start -d '{"command": "python /app/new_app.py", "replace": true}'
    ```
    

HotPod ensures the previous process is gracefully stopped before launching the new one, preventing conflicts and ensuring smooth transitions.

## Use Cases

HotPod significantly improves debugging and process management in multiple scenarios:

* **Fast Debugging Inside Containers**: Update code and restart processes without redeploying the container.
    
* **Local Development**: Hot-reload applications inside containers while preserving state.
    
* **Microservices in Kubernetes**: Manage background jobs within pods without restarting them.
    
* **CI/CD Pipelines**: Execute test suites and manage ephemeral workloads without disrupting container execution.
    

## API & Configuration

HotPod exposes an API for process management, allowing developers to integrate it seamlessly into their workflows.

Full API docs can be found in: [https://github.com/niradler/hotpod/blob/master/swagger.yaml](https://github.com/niradler/hotpod/blob/master/swagger.yaml)

### CLI Configuration Options

| Option | Description | Default |
| --- | --- | --- |
| `-command` | The command to run | `""` |
| `-shell` | The shell to execute the command (e.g., `sh`) | `sh` |
| `-keepalive` | Keep the process running persistently | `false` |
| `-host` | The host to listen on | `localhost` |
| `-port` | The API server port | `8080` |

[https://github.com/niradler/hotpod](https://github.com/niradler/hotpod)
