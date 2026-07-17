import { isPostgresUniqueViolation } from "@/db/pg-errors";
import { propertyInvitesDb } from "@/db/property-invites";
import { propertyMembersDb } from "@/db/property-members";

export async function acceptPendingPropertyInvitesForUser(
  userId: string,
  email: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === "") {
    return;
  }

  const pendingInvites = await propertyInvitesDb.findPendingByEmail(normalizedEmail);
  if (pendingInvites.length === 0) {
    return;
  }

  await Promise.all(
    pendingInvites.map(async (invite) => {
      const existingMember = await propertyMembersDb.findOne(invite.propertyId, userId);
      if (!existingMember) {
        try {
          await propertyMembersDb.add(invite.propertyId, userId, invite.role, invite.invitedBy);
        } catch (error) {
          if (!isPostgresUniqueViolation(error)) {
            throw error;
          }
        }
      }

      await propertyInvitesDb.updateStatus(invite.id, "accepted");
    })
  );
}
