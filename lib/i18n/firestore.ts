import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";

export const listenTranslations = (locale: string, callback: (data: Record<string, string>) => void) => {
  console.log(`Setting up Firestore listener for locale: ${locale}`);
  const ref = doc(db, "translations", locale);

  // onSnapshot provides initial data on first callback, no need for separate getDoc
  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        console.log('Received translation update from Firestore');
        callback(snapshot.data() || {});
      } else {
        console.warn(`No document found for locale: ${locale}`);
        callback({});
      }
    },
    (error) => {
      console.error('Error listening to translations:', error);
      // Blijf luisteren, maar geef lege objecten door
      callback({});
    }
  );

  return () => {
    console.log('Cleaning up Firestore listener');
    unsubscribe();
  };
};