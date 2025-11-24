import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { mockPhotos } from '@/mocks/data';

const inputSchema = z.object({
  projectId: z.string().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getPhotosProcedure = publicProcedure
  .input(inputSchema)
  .query(({ input }) => {
    let filteredPhotos = [...mockPhotos];

    if (input.projectId) {
      filteredPhotos = filteredPhotos.filter(p => p.projectId === input.projectId);
    }

    if (input.category) {
      filteredPhotos = filteredPhotos.filter(p => 
        p.category.toLowerCase().includes(input.category!.toLowerCase())
      );
    }

    if (input.date) {
      filteredPhotos = filteredPhotos.filter(p => 
        p.date.startsWith(input.date!)
      );
    }

    if (input.startDate && input.endDate) {
      filteredPhotos = filteredPhotos.filter(p => 
        p.date >= input.startDate! && p.date <= input.endDate!
      );
    }

    return {
      photos: filteredPhotos,
      total: filteredPhotos.length,
    };
  });
