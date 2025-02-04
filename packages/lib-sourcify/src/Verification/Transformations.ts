export type Transformation = {
  type: 'insert' | 'replace';
  reason:
    | 'constructorArguments'
    | 'library'
    | 'immutable'
    | 'cborAuxdata'
    | 'callProtection';
  offset: number;
  id?: string;
};

// Call protection is always at the start of the runtime bytecode
export const CallProtectionTransformation = (): Transformation => ({
  type: 'replace',
  reason: 'callProtection',
  offset: 1, // 1 byte is always the PUSH20 opcode 0x73
});

// TransformationValues only has one ConstructorTransformatino so no id field is needed
export const ConstructorTransformation = (offset: number): Transformation => ({
  type: 'insert',
  reason: 'constructorArguments',
  offset,
});

export const AuxdataTransformation = (
  offset: number,
  id: string,
): Transformation => ({
  type: 'replace',
  reason: 'cborAuxdata',
  offset,
  id,
});

export const LibraryTransformation = (
  offset: number,
  id: string,
): Transformation => ({
  type: 'replace',
  reason: 'library',
  offset,
  id,
});

export const ImmutablesTransformation = (
  offset: number,
  id: string,
  type: 'replace' | 'insert',
): Transformation => ({
  type,
  reason: 'immutable',
  offset,
  id,
});

export interface TransformationValues {
  constructorArguments?: string;
  callProtection?: string;
  libraries?: {
    [id: string]: string;
  };
  immutables?: {
    [id: string]: string;
  };
  cborAuxdata?: {
    [id: string]: string;
  };
}

export default {
  CallProtectionTransformation,
  ConstructorTransformation,
  AuxdataTransformation,
  LibraryTransformation,
  ImmutablesTransformation,
};
