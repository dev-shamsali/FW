# Services

Services hold business rules. They know nothing about HTTP: they take plain values, return plain values and throw [errors](errors.html).

```ts verify
import { ConflictError, NotFoundError } from "@rheajs/core";

const emails = new Set<string>();
const users = new Map<string, { id: string; email: string }>();

export const userService = {
  register(email: string) {
    if (emails.has(email)) throw new ConflictError("Email already used", { code: "EMAIL_TAKEN" });
    emails.add(email);
    const user = { id: crypto.randomUUID(), email };
    users.set(user.id, user);
    return user;
  },
  get(id: string) {
    const user = users.get(id);
    if (!user) throw new NotFoundError("User not found", { code: "USER_NOT_FOUND" });
    return user;
  },
};
```

Because Express 5 forwards thrown errors, the service can throw directly and the central handler turns it into a response.
