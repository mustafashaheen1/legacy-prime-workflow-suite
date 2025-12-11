import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getUsersProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Users] Fetching users for company:', input.companyId);

    const usersData = await AsyncStorage.getItem('system:users');
    const users = usersData ? JSON.parse(usersData) : [];

    const filteredUsers = input.companyId
      ? users.filter((u: any) => u.companyId === input.companyId)
      : users;

    return { users: filteredUsers };
  });
