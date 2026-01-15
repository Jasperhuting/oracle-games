import { RiderWithBid } from "@/lib/types/pages";
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

// Helper to extract birth year from birthDate
export const getBirthYear = (birthDate: string | number): number => {
  const birth = new Date(birthDate);
  return birth.getFullYear();
};

    // Helper to check if a rider is a neo-professional
    export const isNeoProf = (rider: RiderWithBid, maxNeoProAge: number): boolean => {

      if (!maxNeoProAge) return false;
      if (!rider?.age) return false;
  
      const age = calculateAge(rider.age);
      return age <= maxNeoProAge;
    };

      // Helper to check if a rider qualifies as a neo-prof based on points
export const qualifiesAsNeoProf = (rider: RiderWithBid, gameConfig: { maxNeoProPoints?: number, maxNeoProAge?: number }): boolean => {
  // First check if rider meets the age requirement to be a neo-pro
  if (!isNeoProf(rider, gameConfig.maxNeoProAge || 0)) return false;

  // If no points limit is set, consider them a neo-pro if they meet the age requirement
  if (gameConfig.maxNeoProPoints === undefined) return true;

  // A rider is a neo-pro if their points are LOWER than or equal to the maximum allowed
  // IMPORTANT: If points is undefined, we should NOT default to 0 (which would incorrectly qualify them)
  // Instead, if points is undefined/null, they don't qualify as neo-pro
  const riderPoints = rider?.points ?? null;
  if (riderPoints === null || riderPoints === undefined) return false;

  return riderPoints <= gameConfig.maxNeoProPoints;
};

export  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
