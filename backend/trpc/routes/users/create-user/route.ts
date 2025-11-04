import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const createUserProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['admin', 'salesperson', 'field-employee']),
      companyId: z.string(),
      avatar: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Creating new user:', input.email);

    const usersData = await AsyncStorage.getItem('system:users');
    const users = usersData ? JSON.parse(usersData) : [];

    const existingUser = users.find((u: any) => u.email === input.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

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

    users.push(newUser);
    await AsyncStorage.setItem('system:users', JSON.stringify(users));

    console.log('[Users] User created successfully:', newUser.id);

    return { user: newUser };
  });
