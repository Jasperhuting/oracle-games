import { RiderWithBid } from "@/app/games/[gameId]/auction/page";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// Helper to calculate rider's age
  export const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

    // Helper to check if a rider is a neo-professional
    export const isNeoProf = (rider: RiderWithBid, maxNeoProAge: number): boolean => {
  
      if (!maxNeoProAge) return false;
      if (!rider.age) return false;
  
      const age = calculateAge(rider.age);
      return age <= maxNeoProAge;
    };

      // Helper to check if a rider qualifies as a neo-prof based on points
  export const qualifiesAsNeoProf = (rider: RiderWithBid, maxNeoProPoints: number): boolean => {
    if (!isNeoProf(rider, maxNeoProPoints || 0)) return false;

    const maxPoints = maxNeoProPoints;
    if (maxPoints === undefined) return true; // No points limit

    return rider.points <= maxPoints;
  };