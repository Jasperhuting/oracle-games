/**
 * Shared Rider type for rankings data
 * Used across the application for rider information from the rankings collection
 */

export interface Rider {
  id: string;              // Document ID (usually nameID)
  nameID?: string;         // URL-safe version of name
  name: string;            // Full name
  country: string;         // Country code
  rank?: number;           // UCI ranking position
  points?: number;         // UCI points
  team?: {
    name: string;
    id: string;
  }
  teamId?: string;         // Team document reference ID
  jerseyImage?: string;    // URL to rider's jersey/photo
  retired?: boolean;       // Whether rider is retired
  age?: string | number;   // Age or date of birth
  firstName?: string;      // First name
  lastName?: string;       // Last name
}
