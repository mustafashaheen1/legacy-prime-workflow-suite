import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const updateUserProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      updates: z.object({
        name: z.string().optional(),
        role: z.enum(['super-admin', 'admin', 'salesperson', 'field-employee', 'employee']).optional(),
        isActive: z.boolean().optional(),
        avatar: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        hourlyRate: z.number().optional(),
      }),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Updating user:', input.userId);

    const usersData = await AsyncStorage.getItem('system:users');
    const users = usersData ? JSON.parse(usersData) : [];

    const userIndex = users.findIndex((u: any) => u.id === input.userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    users[userIndex] = { ...users[userIndex], ...input.updates };
    await AsyncStorage.setItem('system:users', JSON.stringify(users));

    console.log('[Users] User updated successfully');

    return { user: users[userIndex] };
  });
