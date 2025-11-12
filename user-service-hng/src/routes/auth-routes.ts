import { FastifyInstance } from "fastify";
import {
  register,
  login,
  refreshToken,
  logoutUser,
} from "../controllers/auth-controller";
export const AuthRoutes = (app: FastifyInstance) => {
  app.post("/register", register);
  app.post("/login", login);
  app.post("/refresh", refreshToken);
  app.post("/logout", logoutUser);
};
