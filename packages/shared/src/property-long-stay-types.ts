export interface IPropertyLongStay {
  createdAt: string;
  guestName: string;
  id: string;
  leaseStartDate: string;
  monthlyRent: number;
  propertyId: string;
  termMonths: number;
  unitId: string;
  updatedAt: string;
}

export interface ICreatePropertyLongStayBody {
  guestName: string;
  leaseStartDate: string;
  monthlyRent: number;
  termMonths: number;
  unitId: string;
}
