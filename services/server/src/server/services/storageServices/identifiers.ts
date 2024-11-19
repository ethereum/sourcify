export enum RWStorageIdentifiers {
  SourcifyDatabase = "SourcifyDatabase",
  RepositoryV1 = "RepositoryV1",
}

export enum WStorageIdentifiers {
  AllianceDatabase = "VerifierAllianceDatabase",
  RepositoryV2 = "RepositoryV2",
  S3Repository = "S3Repository",
}

export type StorageIdentifiers = RWStorageIdentifiers | WStorageIdentifiers;
