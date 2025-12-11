import { publicProcedure } from "../../../create-context.js";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getCompaniesProcedure = publicProcedure
  .query(async () => {
    console.log('[Companies] Fetching all companies');

    const companiesData = await AsyncStorage.getItem('system:companies');
    const companies = companiesData ? JSON.parse(companiesData) : [];

    return { companies };
  });
