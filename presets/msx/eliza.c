/* eliza.c  
 * ys
 * original code by Weizenbaum, 1966
 * this rendition based on Charles Hayden's Java implementation from http://chayden.net/eliza/Eliza.html
 *
 * Note: There are certainly far more optimal and elegant ways to code this... we kept this
 * structure to be faithful to the original.  -scaz 
 */

#include <ctype.h>
#include <stdio.h>
#include <string.h>

#define NUMKEYWORDS 37
#define MAXLINELEN 40
#define NUMSWAPS 14

#include "msxbios.h"
//#link "msxbios.c"


const char *keywords[]= {
       "CAN YOU","CAN I","YOU ARE","YOURE","I DONT","I FEEL",
       "WHY DONT YOU","WHY CANT I","ARE YOU","I CANT","I AM","IM ",
       "YOU ","I WANT","WHAT","HOW","WHO","WHERE",
       "WHEN","WHY",
       "NAME","CAUSE","SORRY","DREAM","HELLO","HI ","MAYBE",
       " NO","YOUR","ALWAYS","THINK","ALIKE","YES","FRIEND",
       "COMPUTER","CAR","NOKEYFOUND"};

const char *SWAPS[NUMSWAPS][2] = {
    {"ARE","AM"},
    {"WERE", "WAS"},
    {"YOU","I"},
    {"YOUR", "MY"},
    {"IVE", "YOU'VE"},
    {"IM", "YOU'RE"},
    {"YOU", "ME"},
    {"ME", "YOU"},
    {"AM","ARE"},
    {"WAS", "WERE"},
    {"I","YOU"},
    {"MY", "YOUR"},
    {"YOUVE", "I'VE"},
    {"YOURE", "I'M"}
};

int ResponsesPerKeyword[NUMKEYWORDS]= {
       3,2,4,4,4,3,
       3,2,3,3,4,4,
       3,5,9,9,9,9,
       9,9,
       2,4,4,4,1,1,5,
       5,2,4,3,7,3,6,
       7,5,6};
           
const char *responses[NUMKEYWORDS][9] = { 
    {   "DON'T YOU BELIEVE THAT I CAN*",
        "PERHAPS YOU WOULD LIKE TO BE ABLE TO*",
        "YOU WANT ME TO BE ABLE TO*"},
    {   "PERHAPS YOU DON'T WANT TO*",
        "DO YOU WANT TO BE ABLE TO*"},
    {   "WHAT MAKES YOU THINK I AM*",
        "DOES IT PLEASE YOU TO BELIEVE I AM*",
        "PERHAPS YOU WOULD LIKE TO BE*",
        "DO YOU SOMETIMES WISH YOU WERE*"},    
    {   "WHAT MAKES YOU THINK I AM*",
        "DOES IT PLEASE YOU TO BELIEVE I AM*",
        "PERHAPS YOU WOULD LIKE TO BE*",
        "DO YOU SOMETIMES WISH YOU WERE*"},
    {   "DON'T YOU REALLY*",
        "WHY DON'T YOU*",
        "DO YOU WISH TO BE ABLE TO*",
        "DOES THAT TROUBLE YOU?"},
    {   "TELL ME MORE ABOUT SUCH FEELINGS.",
        "DO YOU OFTEN FEEL*",
        "DO YOU ENJOY FEELING*"},
    {   "DO YOU REALLY BELIEVE I DON'T*",
        "PERHAPS IN GOOD TIME I WILL*",
        "DO YOU WANT ME TO*"},
    {   "DO YOU THINK YOU SHOULD BE ABLE TO*",
        "WHY CAN'T YOU*"},
    {   "WHY ARE YOU INTERESTED IN WHETHER OR NOT I AM*",
        "WOULD YOU PREFER IF I WERE NOT*",
        "PERHAPS IN YOUR FANTASIES I AM*"},
    {   "HOW DO YOU KNOW YOU CAN'T*",
        "HAVE YOU TRIED?",
        "PERHAPS YOU CAN NOW*"},
    {   "DID YOU COME TO ME BECAUSE YOU ARE*",
        "HOW LONG HAVE YOU BEEN*",
        "DO YOU BELIEVE IT IS NORMAL TO BE*",
        "DO YOU ENJOY BEING*"},
    {   "DID YOU COME TO ME BECAUSE YOU ARE*",
        "HOW LONG HAVE YOU BEEN*",
        "DO YOU BELIEVE IT IS NORMAL TO BE*",
        "DO YOU ENJOY BEING*"},
    {   "WE WERE DISCUSSING YOU-- NOT ME.",
        "OH, I*",
        "YOU'RE NOT REALLY TALKING ABOUT ME, ARE YOU?"},
    {   "WHAT WOULD IT MEAN TO YOU IF YOU GOT*",
        "WHY DO YOU WANT*",
        "SUPPOSE YOU SOON GOT*",
        "WHAT IF YOU NEVER GOT*",
        "I SOMETIMES ALSO WANT*"},
    {   "WHY DO YOU ASK?",
        "DOES THAT QUESTION INTEREST YOU?",
        "WHAT ANSWER WOULD PLEASE YOU THE MOST?",
        "WHAT DO YOU THINK?",
        "ARE SUCH QUESTIONS ON YOUR MIND OFTEN?",
        "WHAT IS IT THAT YOU REALLY WANT TO KNOW?",
        "HAVE YOU ASKED ANYONE ELSE?",
        "HAVE YOU ASKED SUCH QUESTIONS BEFORE?",
        "WHAT ELSE COMES TO MIND WHEN YOU ASK THAT?"},
    {   "WHY DO YOU ASK?",
        "DOES THAT QUESTION INTEREST YOU?",
        "WHAT ANSWER WOULD PLEASE YOU THE MOST?",
        "WHAT DO YOU THINK?",
        "ARE SUCH QUESTIONS ON YOUR MIND OFTEN?",
        "WHAT IS IT THAT YOU REALLY WANT TO KNOW?",
        "HAVE YOU ASKED ANYONE ELSE?",
        "HAVE YOU ASKED SUCH QUESTIONS BEFORE?",
        "WHAT ELSE COMES TO MIND WHEN YOU ASK THAT?"},
    {   "WHY DO YOU ASK?",
        "DOES THAT QUESTION INTEREST YOU?",
        "WHAT ANSWER WOULD PLEASE YOU THE MOST?",
        "WHAT DO YOU THINK?",
        "ARE SUCH QUESTIONS ON YOUR MIND OFTEN?",
        "WHAT IS IT THAT YOU REALLY WANT TO KNOW?",
        "HAVE YOU ASKED ANYONE ELSE?",
        "HAVE YOU ASKED SUCH QUESTIONS BEFORE?",
        "WHAT ELSE COMES TO MIND WHEN YOU ASK THAT?"},
    {   "WHY DO YOU ASK?",
        "DOES THAT QUESTION INTEREST YOU?",
        "WHAT ANSWER WOULD PLEASE YOU THE MOST?",
        "WHAT DO YOU THINK?",
        "ARE SUCH QUESTIONS ON YOUR MIND OFTEN?",
        "WHAT IS IT THAT YOU REALLY WANT TO KNOW?",
        "HAVE YOU ASKED ANYONE ELSE?",
        "HAVE YOU ASKED SUCH QUESTIONS BEFORE?",
        "WHAT ELSE COMES TO MIND WHEN YOU ASK THAT?"},
    {   "WHY DO YOU ASK?",
        "DOES THAT QUESTION INTEREST YOU?",
        "WHAT ANSWER WOULD PLEASE YOU THE MOST?",
        "WHAT DO YOU THINK?",
        "ARE SUCH QUESTIONS ON YOUR MIND OFTEN?",
        "WHAT IS IT THAT YOU REALLY WANT TO KNOW?",
        "HAVE YOU ASKED ANYONE ELSE?",
        "HAVE YOU ASKED SUCH QUESTIONS BEFORE?",
        "WHAT ELSE COMES TO MIND WHEN YOU ASK THAT?"},
    {   "WHY DO YOU ASK?",
        "DOES THAT QUESTION INTEREST YOU?",
        "WHAT ANSWER WOULD PLEASE YOU THE MOST?",
        "WHAT DO YOU THINK?",
        "ARE SUCH QUESTIONS ON YOUR MIND OFTEN?",
        "WHAT IS IT THAT YOU REALLY WANT TO KNOW?",
        "HAVE YOU ASKED ANYONE ELSE?",
        "HAVE YOU ASKED SUCH QUESTIONS BEFORE?",
        "WHAT ELSE COMES TO MIND WHEN YOU ASK THAT?"},
    {   "NAMES DON'T INTEREST ME.",
        "I DON'T CARE ABOUT NAMES-- PLEASE GO ON."},
    {   "IS THAT THE REAL REASON?",
        "DON'T ANY OTHER REASONS COME TO MIND?",
        "DOES THAT REASON EXPLAIN ANY THING ELSE?",
        "WHAT OTHER REASONS MIGHT THERE BE?"},
    {   "PLEASE DON'T APOLOGIZE.",
        "APOLOGIES ARE NOT NECESSARY.",
        "WHAT FEELINGS DO YOU HAVE WHEN YOU APOLOGIZE?",
        "DON'T BE SO DEFENSIVE!"},
    {   "WHAT DOES THAT DREAM SUGGEST TO YOU?",
        "DO YOU DREAM OFTEN?",
        "WHAT PERSONS APPEAR IN YOUR DREAMS?",
        "ARE YOU DISTURBED BY YOUR DREAMS?"},
    {   "HOW DO YOU DO--PLEASE STATE YOUR PROBLEM."},
    {   "HOW DO YOU DO--PLEASE STATE YOUR PROBLEM."},
    {   "YOU DON'T SEEM QUITE CERTAIN.",
        "WHY THE UNCERTAIN TONE?",
        "CAN'T YOU BE MORE POSITIVE?",
        "YOU AREN'T SURE?",
        "DON'T YOU KNOW?"},
    {   "ARE YOU SAYING NO JUST TO BE NEGATIVE?",
        "YOU ARE BEING A BIT NEGATIVE.",
        "WHY NOT?",
        "ARE YOU SURE?",
        "WHY NO?"},
    {   "WHY ARE YOU CONCERNED ABOUT MY*",
        "WHAT ABOUT YOUR OWN*"},
    {   "CAN YOU THINK OF A SPECIFIC EXAMPLE?",
        "WHEN?",
        "WHAT ARE YOU THINKING OF?",
        "REALLY, ALWAYS?"},
    {   "DO YOU REALLY THINK SO?",
        "BUT YOU ARE NOT SURE YOU*",
        "DO YOU DOUBT YOU*"},
    {   "IN WHAT WAY?",
        "WHAT RESEMBLANCE DO YOU SEE?",
        "WHAT DOES THE SIMILARITY SUGGEST TO YOU?",
        "WHAT OTHER CONNECTIONS DO YOU SEE?",
        "COULD THERE REALLY BE SOME CONNECTION?",
        "HOW?"},
    {   "YOU SEEM QUITE POSITIVE.",
        "ARE YOU SURE?",
        "I SEE.",
        "I UNDERSTAND."},
    {   "WHY DO YOU BRING UP THE TOPIC OF FRIENDS?",
        "DO YOUR FRIENDS WORRY YOU?",
        "DO YOUR FRIENDS PICK ON YOU?",
        "ARE YOU SURE YOU HAVE ANY FRIENDS?",
        "DO YOU IMPOSE ON YOUR FRIENDS?",
        "PERHAPS YOUR LOVE FOR FRIENDS WORRIES YOU?"},
    {   "DO COMPUTERS WORRY YOU?",
        "ARE YOU TALKING ABOUT ME IN PARTICULAR?",
        "ARE YOU FRIGHTENED BY MACHINES?",
        "WHY DO YOU MENTION COMPUTERS?",
        "WHAT DO YOU THINK MACHINES HAVE TO DO WITH YOUR PROBLEM?",
        "DON'T YOU THINK COMPUTERS CAN HELP PEOPLE?",
        "WHAT IS IT ABOUT MACHINES THAT WORRIES YOU?"},
    {   "OH, DO YOU LIKE CARS?",
        "MY FAVORITE CAR IS A LAMBORGINI COUNTACH. WHAT IS YOUR FAVORITE     CAR?",
        "MY FAVORITE CAR COMPANY IS FERRARI.  WHAT IS YOURS?",
        "DO YOU LIKE PORSCHES?",
        "DO YOU LIKE PORSCHE TURBO CARRERAS?"},
    {   "SAY, DO YOU HAVE ANY PSYCHOLOGICAL PROBLEMS?",
        "WHAT DOES THAT SUGGEST TO YOU?",
        "I SEE.",
        "I'M NOT SURE I UNDERSTAND YOU FULLY.",
        "COME, COME ELUCIDATE YOUR THOUGHTS.",
        "CAN YOU ELABORATE ON THAT?",
        "THAT IS QUITE INTERESTING."}
        
    
};

void print_center(const char *msg) {
  int numspaces=(MAXLINELEN-strlen(msg))/2;
  int i;  
  for(i=0;i<numspaces;i++)
    printf(" ");
  printf("%s\n", msg);
  return;
}

void print_title () {
    printf("\n\n");
    print_center("*** ELIZA ***");
    print_center("Original code by Weizenbaum, 1966");
    print_center("To stop Eliza, type 'bye'");
    printf("\n\n");
    printf("HI!  I'M ELIZA.  WHAT'S YOUR PROBLEM?\n");
}

void readline(char *instr) {
    char c;
    int slen=0;

    c=getchar();
    while (c != '\n')
    {
        // removes punctuation and sets to uppercase
        if(isalpha(c) || isspace(c))
            instr[slen++]=toupper(c);
        if(slen>MAXLINELEN-1)
        {
          printf("Exceeded Max Line Length\n");
        }
        c=getchar();
    } 
    instr[slen]='\0';
}


void main()
{
  int k,baseLength; 
  int whichReply[NUMKEYWORDS];
  char lastinput[MAXLINELEN];
  char reply[MAXLINELEN];
  char *baseResponse, *token;
  const char separator[2]=" ";
  char inputstr[MAXLINELEN];
  int x,s;
  char *location;

  // use the first reply for each keyword match the first time you see that keyword
  for (x=0;x<NUMKEYWORDS; x++) {
    whichReply[x] = 0;
  }

  // print a nice centered title screen
  INITXT();
  SCNCNT = 1; // set keyboard scan counter
  print_title();

  lastinput[0]='\0';

  while (1) { 
    printf(">");
    readline(inputstr);
    printf("\n");

    // check for termination 
    if (strcmp(inputstr,"BYE")==0)
      break; 

    // check for repeated entries 
    if (strcmp(lastinput,inputstr)==0) 
    {
      printf("PLEASE DON'T REPEAT YOURSELF!\n");
      continue;
    }
    strncpy(lastinput,inputstr,strlen(inputstr)+1); 

    // see if any of the keywords is contained in the input 
    // if not, we use the last element of keywords as our default responses 
    strcpy(reply,"");
    for(k=0;k<NUMKEYWORDS-1;k++)
    {
      location=strstr(inputstr, keywords[k]); 
      if(location != NULL)
        break;
    }

    // Build Eliza's response 
    // start with Eliza's canned response, based on the keyword match
    baseResponse = (char *) responses[k][whichReply[k]];
    baseLength = strlen(baseResponse);

    if(baseResponse[baseLength-1] != '*')
    {
      // if we have a baseResponse without an asterix, just use it as-is
      strcat(reply, baseResponse);
    }
    else
    {
      // if we do have an asterix, fill in the remaining with the user input
      // use all but the last character of the base response
      strncat(reply, baseResponse, baseLength-1);

      // now add in the rest of the user's input, starting at <location>
      // but skip over the keyword itself
      location+=strlen(keywords[k]);
      // take them one word at a time, so that we can substitute pronouns
      token = strtok(location, separator);
      while(token != NULL)
      {
        for(s=0;s<NUMSWAPS;s++)
        {   
          if(strcmp(SWAPS[s][0], token) == 0)
          {
            token = (char *) SWAPS[s][1];
            break;
          }
        }   
        strcat(reply," ");
        strcat(reply, token);
        token=strtok(NULL, separator);
      };
      strcat(reply, "?");
    }
    printf("%s\n", reply);

    // next time, use the next appropriate reply for that keyword
    whichReply[k]++;
    if ( whichReply[k] >= ResponsesPerKeyword[k])
      whichReply[k] = 0;
  } 
  printf( "GOODBYE!  THANKS FOR VISITING WITH ME...\n");
}
