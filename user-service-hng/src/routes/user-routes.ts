import { FastifyInstance } from "fastify";
import {
  getUserProfile,
  getProfileById,
  getPreferenceById,
  updatePreferenceById,
  createPreferenceById,
  addPushToken,
  updatePushTokenById,
  deletePushTokenById,
} from "../controllers/user-controller";
import { verifyToken } from "../middleware/verifyToken";
export const UserRoutes = (app: FastifyInstance) => {
  app.get("/profile", { preHandler: [verifyToken] }, getUserProfile);
  app.get<{ Params: { id: string } }>("/profile/:id", getProfileById);
  app.get<{ Params: { id: string } }>(
    "/preference/:id",
    { preHandler: [verifyToken] },
    getPreferenceById
  );

  app.patch<{ Params: { id: string } }>(
    "/preference/:id",
    { preHandler: [verifyToken] },
    updatePreferenceById
  );
  app.post<{ Params: { id: string } }>(
    "/preference/:id",
    { preHandler: [verifyToken] },
    createPreferenceById
  );

  app.post("/push-token", { preHandler: [verifyToken] }, addPushToken);
  app.patch<{ Params: { id: string } }>(
    "/push-token/:id",
    { preHandler: [verifyToken] },
    updatePushTokenById
  );
  app.delete<{ Params: { id: string } }>(
    "/push-token/:id",
    { preHandler: [verifyToken] },
    deletePushTokenById
  );
};
