import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export async function verifyToken(req: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token ?? "", process.env.ACCESS_SECRET!) as any;
    const userId = payload?.userId;
    const role = payload?.role;
    if (!userId)
      return reply.code(401).send({ message: "Invalid token payload" });
    (req as any).user = { id: userId, role };
    return;
  } catch (err) {
    console.error("Token verification error:", err);
    return reply.code(401).send({ message: "Invalid or expired token" });
  }
}
