
? "Starting!"
NumIter = 10
sTime = TIME
' Arrays are initialized to 0
DIM A(8190) Byte
FOR Iter= 1 TO NumIter
  MSET Adr(A), 8190, 0
  Count = 0
  FOR I = 0 TO 8190
    IF NOT A(I)
      Prime = I + I + 3
      FOR K = I + Prime TO 8190 STEP Prime
        A(K) = 1
      NEXT K
      INC Count
    ENDIF
  NEXT I
NEXT Iter

eTime = TIME
? "End."
? "Elapsed time: "; eTime-sTime; " in "; NumIter; " iterations."
? "Found "; Count; " primes."

input "PRESS ENTER TO EXIT...";NAME$
