FROM golang:1.21-alpine AS build
WORKDIR /src
COPY go.mod .
RUN go mod download || true
COPY . .
RUN go mod tidy
RUN go build -o /bin/gateway

FROM alpine:3.19
WORKDIR /app
COPY --from=build /bin/gateway /app/gateway
EXPOSE 8080
CMD ["/app/gateway"]