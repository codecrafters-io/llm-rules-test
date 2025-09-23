In this stage, you'll add support for appending multiple elements in a single `RPUSH` command.

### The `RPUSH` command with multiple elements

`RPUSH` can add multiple elements at a time. This works whether you are creating a new list or appending to an existing one.

```bash
# Creating a new list with multiple elements
> RPUSH another_list "bar" "baz"
(integer) 2

# Appending elements to an existing list
> RPUSH another_list "foo" "bar" "baz"
(integer) 5
```

The response to each command is the new length of the list returned as a [RESP integer](https://redis.io/docs/latest/develop/reference/protocol-spec/#integers).

### Tests

The tester will execute your program like this:

```
./your_program.sh
```

It will then send multiple `RPUSH` commands, each including multiple elements to append to the list.

```bash
$ redis-cli RPUSH list_key "element1" "element2" "element3"
# Expect: (integer) 3 → encoded as :3\r\n

$ redis-cli RPUSH list_key "element4" "element5"
# Expect: (integer) 5 → encoded as :5\r\n
```

For each command, the tester will expect the response to be the list's length encoded as a RESP integer.