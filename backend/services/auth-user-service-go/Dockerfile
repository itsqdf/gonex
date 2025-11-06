FROM golang:1.21-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN go mod tidy
RUN go build -o /bin/auth

FROM alpine:3.19
WORKDIR /app
COPY --from=build /bin/auth /app/auth
EXPOSE 3000
CMD ["/app/auth"]