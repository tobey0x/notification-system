import { FastifyReply, FastifyRequest, RouteHandlerMethod } from "fastify";
import { prisma } from "../index";
import id from "zod/v4/locales/id.js";

export const getUserProfile = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (req as FastifyRequest & { user?: any }).user?.id ?? null;
    if (!userId) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preference: true, pushTokens: true },
    });
    if (!user) return reply.status(404).send({ message: "User not found" });

    return reply.status(200).send({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        preference: user.preference ?? null,
        pushTokens: user.pushTokens ?? [],
      },
      message: "User profile fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const getProfileById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return reply.status(400).send({ message: "User ID is required" });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preference: true, pushTokens: true },
    });
    if (!user) return reply.status(404).send({ message: "User not found" });

    return reply.status(200).send({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        preference: user.preference ?? null,
        pushTokens: user.pushTokens ?? [],
      },
      message: "User profile fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const getPreferenceById: RouteHandlerMethod = async (req, reply) => {
  try {
    const { id } = (req.params as { id?: string }) ?? {};
    if (!id) {
      return reply.status(400).send({ message: "User ID is required" });
    }
    const preference = await prisma.userPreference.findUnique({
      where: { userId: id },
    });
    if (!preference) {
      return reply.status(404).send({ message: "Preference not found" });
    }
    return reply.status(200).send({
      data: preference,
      message: "Preference fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const updatePreferenceById: RouteHandlerMethod = async (req, reply) => {
  try {
    const { id } = (req.params as { id?: string }) ?? {};
    if (!id) {
      return reply.status(400).send({ message: "User ID is required" });
    }

    const body = req.body as Partial<{
      email_enabled: boolean;
      push_enabled: boolean;
      language: string;
      timezone?: string | null;
    }>;

    if (!body || Object.keys(body).length === 0) {
      return reply.status(400).send({ message: "No data provided to update" });
    }

    const existing = await prisma.userPreference.findUnique({
      where: { userId: id },
    });
    if (!existing) {
      return reply.status(404).send({ message: "Preference not found" });
    }

    const updated = await prisma.userPreference.update({
      where: { userId: id },
      data: body as any,
    });

    return reply.status(200).send({
      data: updated,
      message: "Preference updated successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const createPreferenceById: RouteHandlerMethod = async (req, reply) => {
  try {
    const { id } = (req.params as { id?: string }) ?? {};
    if (!id) {
      return reply.status(400).send({ message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    const existing = await prisma.userPreference.findUnique({
      where: { userId: id },
    });
    if (existing) {
      return reply
        .status(409)
        .send({ message: "Preference already exists for this user" });
    }

    const body = req.body as Partial<{
      email_enabled: boolean;
      push_enabled: boolean;
      language: string;
      timezone?: string | null;
    }>;

    const email_enabled = body?.email_enabled ?? true;
    const push_enabled = body?.push_enabled ?? true;
    const language = body?.language ?? "en";
    const timezone = body?.timezone ?? null;

    const created = await prisma.userPreference.create({
      data: {
        userId: id,
        email_enabled,
        push_enabled,
        language,
        timezone,
      },
    });

    return reply.status(201).send({
      data: created,
      message: "Preference created successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const addPushToken: RouteHandlerMethod = async (req, reply) => {
  try {
    const userId = (req as FastifyRequest & { user?: any }).user?.id ?? null;
    if (!userId) return reply.status(401).send({ message: "Unauthorized" });

    const body = req.body as {
      token?: string;
      platform?: string;
      device_name?: string | null;
    };

    if (!body || !body.token) {
      return reply.status(400).send({ message: "Push token is required" });
    }

    const created = await prisma.pushToken.create({
      data: {
        userId,
        token: body.token,
        platform: body.platform ?? "android",
        device_name: body.device_name ?? null,
      },
    });

    return reply.status(201).send({
      data: created,
      message: "Push token added successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const updatePushTokenById: RouteHandlerMethod = async (req, reply) => {
  try {
    const userId = (req as FastifyRequest & { user?: any }).user?.id ?? null;
    if (!userId) return reply.status(401).send({ message: "Unauthorized" });

    const { id } = (req.params as { id?: string }) ?? {};
    if (!id)
      return reply.status(400).send({ message: "Push token ID is required" });

    const existing = await prisma.pushToken.findUnique({ where: { id } });
    if (!existing)
      return reply.status(404).send({ message: "Push token not found" });
    if (existing.userId !== userId)
      return reply.status(403).send({ message: "Forbidden" });

    const body = req.body as Partial<{
      token: string;
      platform: string;
      device_name?: string | null;
    }>;
    if (!body || Object.keys(body).length === 0) {
      return reply.status(400).send({ message: "No data provided to update" });
    }

    const updated = await prisma.pushToken.update({
      where: { id },
      data: body as any,
    });
    return reply.status(200).send({
      data: updated,
      message: "Push token updated successfully",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};

export const deletePushTokenById: RouteHandlerMethod = async (req, reply) => {
  try {
    const userId = (req as FastifyRequest & { user?: any }).user?.id ?? null;
    if (!userId) return reply.status(401).send({ message: "Unauthorized" });

    const { id } = (req.params as { id?: string }) ?? {};
    if (!id)
      return reply.status(400).send({ message: "Push token ID is required" });

    const existing = await prisma.pushToken.findUnique({ where: { id } });
    if (!existing)
      return reply.status(404).send({ message: "Push token not found" });
    if (existing.userId !== userId)
      return reply.status(403).send({ message: "Forbidden" });

    await prisma.pushToken.delete({ where: { id } });
    return reply.status(204).send();
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};
