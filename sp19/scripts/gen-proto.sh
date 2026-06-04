#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$ROOT_DIR/api/proto"
OUT_DIR="$ROOT_DIR/api/proto"

mkdir -p "$OUT_DIR"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: $1 is not installed"
        exit 1
    fi
}

check_command protoc
check_command go

echo "Installing protoc plugins..."
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest

echo "Downloading googleapis..."
TMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/googleapis/googleapis.git "$TMP_DIR/googleapis" 2>/dev/null || true

echo "Generating gRPC code..."

for proto_file in "$PROTO_DIR"/*.proto; do
    if [ -f "$proto_file" ]; then
        echo "Processing: $(basename "$proto_file")"
        protoc \
            -I "$PROTO_DIR" \
            -I "$TMP_DIR/googleapis" \
            --go_out="$OUT_DIR" \
            --go_opt=paths=source_relative \
            --go-grpc_out="$OUT_DIR" \
            --go-grpc_opt=paths=source_relative \
            --grpc-gateway_out="$OUT_DIR" \
            --grpc-gateway_opt=paths=source_relative \
            "$proto_file"
    fi
done

rm -rf "$TMP_DIR"

echo "Done! gRPC code generated successfully."
