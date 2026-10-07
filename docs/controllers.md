# Controllers

A controller maps HTTP to a service call and sends the response. Keep business logic out of it.

```ts verify
import { sendSuccess, type Request, type Response } from "@rheajs/core";

const service = { list: () => [{ id: "1" }] };

export const itemsController = {
  list(_req: Request, res: Response) {
    sendSuccess(res, service.list());
  },
  create(req: Request, res: Response) {
    sendSuccess(res, req.body, "Created", 201);
  },
};
```

`sendSuccess(res, data, message = "Success", status = 200)` writes `{ success: true, data, message }`. Change the shape for the whole app with a [custom formatter](errors.html#custom-response-format).
