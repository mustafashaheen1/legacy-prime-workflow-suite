import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const createUserProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['admin', 'salesperson', 'field-employee', 'employee']),
      companyId: z.string(),
      avatar: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Creating new user:', input.email);

    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      email: input.email,
      role: input.role,
      companyId: input.companyId,
      avatar: input.avatar,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    console.log('[Users] User created successfully:', newUser.id);

    return { user: newUser };
  });
