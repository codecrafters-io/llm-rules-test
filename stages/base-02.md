In this stage, you'll implement support for the [PING](https://redis.io/commands/ping) command.

### Redis Commands

Redis clients communicate with Redis servers by sending [commands](https://redis.io/commands/). Each command receives a response from the Redis server.

For example:
```bash
$ redis-cli SET name Alice
OK
```
Here, the client sends a [`SET`](https://redis.io/docs/latest/commands/set/) command to store the key `name` with the value `Alice`. The server responds with `OK`, confirming that the action was successful.

Both commands and responses are encoded using the [Redis serialization protocol (RESP)](https://redis.io/docs/latest/develop/reference/protocol-spec/). We'll learn more about this in later stages.

### The `PING` Command

The [PING](https://redis.io/commands/ping/) command checks the health of a Redis server.

```bash
$ redis-cli PING
PONG
```

The response for the `PING` command is `+PONG\r\n`. This is the string "PONG" encoded as a [RESP simple string](https://redis.io/docs/latest/develop/reference/protocol-spec/#simple-strings).

For this stage, you can ignore the client input and hardcode `+PONG\r\n` as a response. We'll get to parsing the client's input in later stages.

### Tests

The tester will execute your program like this:

```bash
$ ./your_program.sh
```

It will then send a `PING` command to your server:

```bash
$ redis-cli PING
```

Your server should respond with `+PONG\r\n`.

### Notes

- The exact bytes your program will receive will be something like this: `*1\r\n$4\r\nPING\r\n`, which is the Redis protocol encoding of the `PING` command. We'll learn more about this in later stages.