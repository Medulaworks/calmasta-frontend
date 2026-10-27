import {expect,it} from "vitest";
import {updateTranscriptDraft,pendingTranscriptDrafts} from "./transcript-drafts";
it("retains a revert while the changed value is being saved",()=>{expect(updateTranscriptDraft({line:"Changed"},"line","Original","Original",{}, {line:"Changed"})).toEqual({line:"Original"});});
it("compares against acknowledged text before refreshed props arrive",()=>{expect(updateTranscriptDraft({},"line","Original","Original",{line:"Changed"})).toEqual({line:"Original"});});
it("clears a draft only when it matches the effective server value",()=>{expect(updateTranscriptDraft({line:"More"},"line","Changed","Original",{line:"Changed"})).toEqual({});});
it("save completion retains later typing and speaker reversions",()=>{expect(pendingTranscriptDrafts({line:"Original",other:"Saved"},{line:"Changed",other:"Saved"})).toEqual({line:"Original"});expect(pendingTranscriptDrafts({A:""},{A:"Maya"})).toEqual({A:""});});
