"use client";

import { createContext, useContext } from "react";
import type { ProfileView } from "@/lib/profile-client";

interface ProfileState {
  profile: ProfileView | null;
  setProfile: (p: ProfileView) => void;
}

/** The signed-in user's profile, fetched once by the shell. `profile` is null when it couldn't be read. */
const ProfileContext = createContext<ProfileState>({ profile: null, setProfile: () => {} });

export const ProfileProvider = ProfileContext.Provider;
export const useProfile = () => useContext(ProfileContext).profile;
export const useSetProfile = () => useContext(ProfileContext).setProfile;
