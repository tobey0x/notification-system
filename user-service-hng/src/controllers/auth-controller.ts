import { FastifyRequest, FastifyReply } from "fastify";
import type { RegisterBody } from "@/lib/auth-types";
import { z } from "zod";
import { prisma } from "../index";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { generateTokens } from "../utils/generate-tokens";

const registerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const logoutUser = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return reply.code(401).send({ message: "No token provided" });
    }

    const payload: any = jwt.verify(token, process.env.ACCESS_SECRET!);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });

    return reply.send({ message: "Logged out successfully", success: true });
  } catch (err) {
    return reply.code(401).send({ message: "Invalid or expired token" });
  }
};

export const refreshToken = async (
  req: FastifyRequest<{ Body: { token: string } }>,
  reply: FastifyReply
) => {
  const { token } = req.body;
  if (!token) return reply.code(400).send({ message: "Token missing" });

  try {
    const payload: any = jwt.verify(token, process.env.REFRESH_SECRET!);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || user.refreshToken !== token)
      return reply.code(401).send({ message: "Invalid refresh token" });

    const { accessToken, refreshToken: newRefresh } = generateTokens({
      userId: user.id,
      role: user.role,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefresh },
    });

    return reply.send({
      data: { access_token: accessToken, refresh_token: newRefresh },
      message: "Token refreshed successfully",
      success: true,
    });
  } catch (err) {
    console.error(err);
    return reply
      .code(401)
      .send({ message: "Invalid or expired refresh token" });
  }
};

export const login = async (
  req: FastifyRequest<{ Body: z.infer<typeof loginSchema> }>,
  reply: FastifyReply
) => {
  try {
    const parsedBody = loginSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }
    const { email, password } = parsedBody.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply
        .status(400)
        .send({ message: "User not found. Invalid email" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply
        .status(400)
        .send({ message: "Invalid password. Check Credentials and try again" });
    }
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      role: user.role,
    });
    await prisma.user.update({
      where: { email },
      data: { refreshToken },
    });
    return reply.status(200).send({
      data: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      message: "User logged in successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const register = async (
  req: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply
) => {
  try {
    const parsedBody = registerSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }
    const { role } = req.body;
    const { name, password, email } = parsedBody.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return reply.code(400).send({ message: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role || "user",
      },
    });
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      role: user.role,
    });
    await prisma.user.update({
      where: { email },
      data: { refreshToken },
    });
    return reply.status(201).send({
      data: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      message: "User registered successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
