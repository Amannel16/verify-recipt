/* eslint-disable @typescript-eslint/no-namespace */
import { ROLE } from "./role.js";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo: string;
  role: ROLE;
  phoneNumber: string;
};

import type { SafeUser } from "../utils/helper/auth.js";

declare global {
  namespace Express {
    interface Request {
      user: SafeUser;
    }
  }
}
