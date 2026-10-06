/**
 * Een naam die alleen in JSX staat, is gebruikt.
 *
 * Zonder eslint-plugin-react ziet `no-unused-vars` `<Acties />` niet als een
 * gebruik van `Acties`. Daarom stond er een uitzondering voor elke naam met een
 * hoofdletter, en daardoor bleven ongebruikte componentimports jaren staan (33
 * bestanden op 6 oktober 2026). Deze regel markeert wat in JSX staat als
 * gebruikt, zodat die uitzondering weg kan. Eén ding, geen extra afhankelijkheid.
 */
export default {
  rules: {
    'jsx-gebruikt': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const bron = context.sourceCode
        const markeer = (naam, node) => bron.markVariableAsUsed(naam, node)
        return {
          JSXOpeningElement(node) {
            let n = node.name
            while (n.type === 'JSXMemberExpression') n = n.object
            if (n.type === 'JSXIdentifier') markeer(n.name, node)
          },
        }
      },
    },
  },
}
