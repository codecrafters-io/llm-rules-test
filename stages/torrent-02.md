In this stage, you'll parse a torrent file and print information about the torrent.

### Torrent File Structure

A torrent file (also known as a [**metainfo file**](https://www.bittorrent.org/beps/bep_0003.html#metainfo-files)) contains all the information needed to download or share content via [BitTorrent](https://www.bittorrent.org/beps/bep_0003.html).

A torrent file consists of a bencoded dictionary with the following keys:

* `announce`: The URL to a "tracker", which is a central server that keeps track of peers participating in the sharing of a torrent
    
* `info`: A dictionary containing file-specific information, including:
    
    * `length`: Size of the file in bytes (for single-file torrents)
        
    * `name`: Suggested name to save the file or directory as
        
    * `piece length`: Number of bytes in each piece the file is divided into
        
    * `pieces`: Concatenated SHA-1 hashes of each piece

Conceptually, a simple torrent file would look like this in its bencoded format:
```bash
d8:announce37:http://bittorrent-test-tracker.codecrafters.io/announce4:info
d6:lengthi92063e4:name11:sample.txt12:piece lengthi131072e6:pieces20:....e
```

Your parser needs to navigate this structure to extract the 'announce' string and the 'length' integer from the nested 'info' dictionary.

### Tests

The tester will execute your program like this:

```bash
$ ./your_program.sh info sample.torrent
```

It will then check that your program outputs the tracker URL and file length in this exact format:

```plaintext
Tracker URL: http://bittorrent-test-tracker.codecrafters.io/announce
Length: 92063
```

### Notes

* You'll need to decode the torrent file before extracting the required information.
    
* Torrent files contain bytes that aren’t valid UTF-8 characters. If the language you're using treats strings as a sequence of Unicode characters (like Python's [**str**](https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str)), you'll need to use a byte sequence (like Python's [**bytes**](https://docs.python.org/3/library/stdtypes.html#bytes-objects)) instead.
    
* This stage focuses specifically on parsing single-file torrents. The structure of the `info` dictionary differs for multi-file torrents, which are not included in this challenge.