#!/bin/bash

cd "$(dirname "$0")"

echo "Starting 10 worker nodes..."

for i in {1..10}
do
    go run worker/main.go "worker-$i" &
    echo "Started worker-$i (PID: $!)"
    sleep 0.5
done

echo "All workers started. Press Ctrl+C to stop."
trap "echo 'Stopping workers...'; pkill -f 'worker/main.go'" SIGINT
wait
